-- ========================================================
-- Restore Original Plaintext Passwords to Supabase Auth
-- Target Project: kumijiwepididcsyqchy
-- ========================================================

-- John Lawrence Soriano (Provider)
UPDATE auth.users
SET encrypted_password = crypt('12345678', gen_salt('bf'))
WHERE email = 'johnlawrence@gmail.com';

-- Andrew Ymson (Patient)
UPDATE auth.users
SET encrypted_password = crypt('andrew123', gen_salt('bf'))
WHERE email = 'andrew@gmail.com';

-- System Admin (Admin)
UPDATE auth.users
SET encrypted_password = crypt('admin123', gen_salt('bf'))
WHERE email = 'admin@munticares.com';

-- Mark Daniel Verdijo (Patient)
UPDATE auth.users
SET encrypted_password = crypt('12345678', gen_salt('bf'))
WHERE email = 'markdaniel@gmail.com';

-- Bryan Pabilar (Patient)
UPDATE auth.users
SET encrypted_password = crypt('kalkal', gen_salt('bf'))
WHERE email = 'pabilarbryan@gmail.com';

-- Rene (Patient)
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'rene@gmail.com';

-- Johnny (Patient)
UPDATE auth.users
SET encrypted_password = crypt('john123', gen_salt('bf'))
WHERE email = 'johnny@gmail.com';

-- Mark Verdijo (Patient)
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'markverdijo0809@gmail.com';

