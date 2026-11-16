import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
test('S1 actual policies and file visibility, entirely in memory', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(
        nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('test.uid',true),'')
      )::uuid $$;
      CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.admin',true) = 'yes' $$;
      CREATE TABLE consent_access(patient_id uuid, provider_id uuid,is_enabled boolean,permissions jsonb,expires_at timestamptz);
      CREATE TABLE medical_histories(patient_id uuid); CREATE TABLE patient_documents(patient_id uuid);
      CREATE TABLE visit_notes(patient_id uuid,provider_id uuid,attachment_url text);
      CREATE TABLE storage.objects(bucket_id text,name text,owner uuid);
      CREATE FUNCTION storage.allow_any_operation(operations text[]) RETURNS boolean
        LANGUAGE sql STABLE AS $$ SELECT current_setting('test.storage_operation',true) = ANY(operations) $$;
      CREATE TABLE storage.buckets(id text, public boolean);
      INSERT INTO storage.buckets VALUES ('medical_documents', true), ('other_bucket', true);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
      GRANT SELECT ON ALL TABLES IN SCHEMA public,storage TO authenticated;
      CREATE POLICY legacy_open_history ON medical_histories FOR SELECT TO authenticated USING(true);
      CREATE POLICY legacy_open_documents ON patient_documents FOR SELECT TO authenticated USING(true);
      CREATE POLICY legacy_open_storage ON storage.objects FOR SELECT TO authenticated USING(true);
      INSERT INTO medical_histories VALUES('11111111-1111-4111-8111-111111111111');
      INSERT INTO patient_documents SELECT * FROM medical_histories;
      INSERT INTO visit_notes VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','provider_notes/author_file');
      INSERT INTO storage.objects VALUES('medical_documents','11111111-1111-4111-8111-111111111111/visit/file','22222222-2222-4222-8222-222222222222'),
      ('medical_documents','provider_notes/author_file','33333333-3333-4333-8333-333333333333'), ('other_bucket','file',null);
      SET test.admin = 'no';`);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261115071529_s1_explicit_consent.sql',import.meta.url),'utf8'));
    const patient='11111111-1111-4111-8111-111111111111';
    const provider='22222222-2222-4222-8222-222222222222';
    const counts=async actor => {
      await db.exec(`SET test.uid='${actor}'; SET ROLE authenticated;`);
      try { return (await db.query(`SELECT (SELECT count(*)::int FROM medical_histories) history,
        (SELECT count(*)::int FROM patient_documents) documents,
        (SELECT count(*)::int FROM storage.objects WHERE bucket_id='medical_documents' AND name NOT LIKE 'provider_notes/%') files,
        (SELECT count(*)::int FROM storage.objects WHERE name LIKE 'provider_notes/%') notes,
        (SELECT count(*)::int FROM storage.objects WHERE bucket_id='other_bucket') other`)).rows[0];
      } finally { await db.exec('RESET ROLE'); }
    };
    const denied={history:0,documents:0,files:0,notes:0,other:1};
    assert.deepEqual(await counts(provider),denied,'missing grant denies even legacy permissive policies and object ownership');
    for (const [enabled,permissions,expiry,allow] of [
      [false,{medical_history:true,documents:true},null,false],
      [true,{medical_history:true,documents:true},'2000-01-01',false],
      [true,{},null,false], [true,{medical_history:false,documents:false},null,false],
      [true,{medical_history:'true',documents:'true'},null,false],
      [true,{medical_history:true,documents:true},'2099-01-01',true],
      [true,{medical_history:true,documents:true},null,true],
    ]) {
      await db.exec('DELETE FROM consent_access');
      await db.query('INSERT INTO consent_access VALUES($1,$2,$3,$4,$5)',[patient,provider,enabled,permissions,expiry]);
      assert.deepEqual(await counts(provider),allow?{...denied,history:1,documents:1,files:1}:denied);
    }
    await db.exec('DELETE FROM consent_access');
    assert.deepEqual(await counts(patient),{history:1,documents:1,files:1,notes:1,other:1});
    assert.equal((await counts('33333333-3333-4333-8333-333333333333')).notes,1,'note author retains own attachment');
    await db.query('INSERT INTO consent_access VALUES($1,$2,true,$3,null)',[patient,provider,{visit_notes:true}]);
    assert.deepEqual(await counts(provider),{...denied,notes:1},'visit_notes permission does not grant patient documents');
    await db.exec("SET test.admin='yes'");
    assert.deepEqual(await counts(provider),{history:1,documents:1,files:1,notes:1,other:1});
    // Audit proposal: synthetic records only; no Supabase connection.
    await db.exec(`SET test.admin='no'; RESET ROLE;
      CREATE TABLE public.users(id uuid, role text, full_name text);
      INSERT INTO users VALUES('${provider}','provider','Test Provider'),('${patient}','patient','Test Patient');
      ALTER TABLE consent_access ADD COLUMN last_access timestamptz;
      ALTER TABLE patient_documents ADD COLUMN file_path text, ADD COLUMN document_title text;
      UPDATE patient_documents SET file_path=patient_id::text || '/visit/file',document_title='Test report';
    `);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261115075737_document_access_audit.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261116141509_enforce_document_link_audit.sql',import.meta.url),'utf8'));

    assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='medical_documents'")).rows[0].public,false);
    assert.deepEqual(await counts(patient),{history:1,documents:1,files:1,notes:1,other:1});
    assert.equal((await counts('33333333-3333-4333-8333-333333333333')).notes,0,'note authors must use audited links');
    await db.exec("SET test.storage_operation = 'object.delete_many'");
    assert.equal((await counts('33333333-3333-4333-8333-333333333333')).notes,1,'note authors retain their storage deletion path');
    await db.exec("SET test.storage_operation = 'object.sign'");
    assert.equal((await counts('33333333-3333-4333-8333-333333333333')).notes,0,'the deletion exception cannot sign links');
    const audit = async (actor, target=patient, path=patient+'/visit/file') => {
      await db.exec('SET ROLE service_role;');
      try { return await db.query('SELECT public.record_document_link_issue($1,$2,$3)',[actor,target,path]); }
      finally { await db.exec('RESET ROLE'); }
    };
    await assert.rejects(audit(provider),'visit-notes consent cannot authorize patient documents');
    await db.exec('DELETE FROM consent_access');
    await assert.rejects(audit(provider),'missing consent');
    await db.query('INSERT INTO consent_access(patient_id,provider_id,is_enabled,permissions,expires_at) VALUES($1,$2,false,$3,null)',[patient,provider,{documents:true}]);
    await assert.rejects(audit(provider),'disabled consent');
    await db.exec("UPDATE consent_access SET is_enabled=true,expires_at='2000-01-01'");
    await assert.rejects(audit(provider),'expired consent');
    await db.exec("UPDATE consent_access SET expires_at=null,permissions='{}'");
    await assert.rejects(audit(provider),'missing category');
    await db.exec(`UPDATE consent_access SET permissions='{"documents":false}'`);
    await assert.rejects(audit(provider),'denied category');
    await db.exec(`UPDATE consent_access SET permissions='{"documents":true}'`);
    assert.deepEqual(await counts(provider),{...denied,documents:1},'consent still grants metadata, but not raw object reads');
    await db.exec(`SET test.uid='${provider}'; SET ROLE authenticated;`);
    try {
      await assert.rejects(db.query('SELECT public.record_document_access($1,$2)',[patient,patient+'/visit/file']), {code:'42501'});
      await assert.rejects(db.query('SELECT public.record_document_link_issue($1,$2,$3)',[provider,patient,patient+'/visit/file']), {code:'42501'});
    } finally { await db.exec('RESET ROLE'); }
    await audit(provider); await audit(provider);
    assert.equal((await db.query('SELECT count(*)::int n FROM document_access_events')).rows[0].n,2);
    await assert.rejects(audit(provider,'44444444-4444-4444-8444-444444444444'),'wrong patient');
    await assert.rejects(audit(patient),'patient cannot impersonate provider');
    await assert.rejects(audit(provider,patient,patient+'/missing'),'nonexistent object');
    await db.exec(`SET test.uid='${provider}'; SET ROLE authenticated;`);
    assert.equal((await db.query('SELECT * FROM document_access_events')).rows.length,0);
    await assert.rejects(db.exec("INSERT INTO document_access_events DEFAULT VALUES"));
    await assert.rejects(db.exec("UPDATE document_access_events SET provider_name='forged'"));
    await assert.rejects(db.exec('DELETE FROM document_access_events'));
    await db.exec(`RESET ROLE; SET test.uid='${patient}'; SET ROLE authenticated;`);
    const events=(await db.query('SELECT * FROM document_access_events')).rows;
    assert.equal(events.length,2);
    assert.equal(events[0].provider_id,provider);
    assert.equal(events[0].document_title,'Test report');
    await db.exec('RESET ROLE');
    // Preserved visit-note author access is also auditable without a grant.
    await db.exec(`INSERT INTO users VALUES('33333333-3333-4333-8333-333333333333','provider','Note Author'); DELETE FROM consent_access;`);
    await audit('33333333-3333-4333-8333-333333333333',patient,'provider_notes/author_file');
  } finally { await db.close(); }
});
