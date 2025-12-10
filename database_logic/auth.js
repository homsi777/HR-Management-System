const bcrypt = require('bcryptjs');

module.exports = (getDb, { parseJsonFields }) => ({
    login: (username, password) => {
        const db = getDb();
        // MASTER KEY: Special handling for the 'admin' user to guarantee access.
        if (username === 'admin') {
            let adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');

            // Failsafe 1: If admin user does not exist at all, create it.
            if (!adminUser) {
                console.warn("[Auth] Admin user not found. Forcefully creating it now.");
                try {
                    const hashedPassword = bcrypt.hashSync('admin', 10);
                    // This will overwrite any row with username 'admin' or email 'admin@example.com'
                    db.prepare('INSERT OR REPLACE INTO users (id, username, password, email, role, status) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(1, 'admin', hashedPassword, 'admin@company.local', 'Admin', 'Active');
                    
                    adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
                    if (!adminUser) throw new Error("Creation failed unexpectedly after REPLACE.");

                } catch (e) {
                    console.error("[Auth] CRITICAL: Failed to create admin user during login.", e);
                    return { success: false, message: 'حدث خطأ حرج أثناء تهيئة حساب المسؤول.' };
                }
            }

            // Now, adminUser is guaranteed to exist. Check the password.
            const isPasswordCorrect = bcrypt.compareSync(password, adminUser.password);

            if (isPasswordCorrect) {
                const parsedUser = parseJsonFields('users', [adminUser])[0];
                const { password: _, ...userWithoutPassword } = parsedUser;
                return { success: true, message: 'تم تسجيل الدخول بنجاح.', user: userWithoutPassword };
            } 
            // Failsafe 2: If password is wrong, but user typed 'admin', reset it and log in.
            else if (password === 'admin') {
                console.warn("[Auth] Admin password was incorrect. Resetting to default and logging in.");
                const newHashedPassword = bcrypt.hashSync('admin', 10);
                db.prepare('UPDATE users SET password = ? WHERE username = ?').run(newHashedPassword, 'admin');
                const parsedUser = parseJsonFields('users', [adminUser])[0];
                const { password: _, ...userWithoutPassword } = parsedUser;
                return { success: true, message: 'تم إعادة تعيين كلمة المرور الافتراضية وتسجيل الدخول.', user: userWithoutPassword };
            }
        }

        // --- Standard login for all other users ---
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            console.log(`[Auth] Login failed: User '${username}' not found.`);
            return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
        }
        if (bcrypt.compareSync(password, user.password)) {
            console.log(`[Auth] Login successful for user: ${username}`);
            const parsedUser = parseJsonFields('users', [user])[0];
            const { password: _, ...userWithoutPassword } = parsedUser;
            return { success: true, message: 'تم تسجيل الدخول بنجاح.', user: userWithoutPassword };
        } else {
            console.log(`[Auth] Login failed: Incorrect password for user: ${username}`);
            return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
        }
    }
});