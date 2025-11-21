-- Update the role of the current user to SUPER_ADMIN
-- Replace 'your-email@gmail.com' with your actual email

UPDATE User 
SET role = 'SUPER_ADMIN' 
WHERE email = 'dodgeballclubmonash@gmail.com';

-- Verify the update
SELECT id, email, role FROM User;
