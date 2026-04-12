const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'staff', 'admin')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create notices table
  db.run(`
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_role TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create courses table
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      instructor TEXT,
      semester INTEGER,
      notes TEXT
    )
  `);

  // Insert sample courses
  const courses = [
    ['ENV101', 'Environmental Chemistry', 'Study of chemical processes in the environment', 'Dr. Sarah Johnson', 1, 'Introduction to environmental chemistry concepts'],
    ['ENV102', 'Water Treatment Technologies', 'Advanced water purification methods', 'Prof. Michael Chen', 2, 'Water treatment processes and technologies'],
    ['ENV201', 'Air Pollution Control', 'Management of air quality and pollutants', 'Dr. Emily Brown', 3, 'Air pollution monitoring and control strategies'],
    ['ENV202', 'Waste Management', 'Solid and hazardous waste treatment', 'Prof. David Wilson', 4, 'Waste reduction and recycling techniques'],
    ['ENV301', 'Climate Change Studies', 'Impact and mitigation of climate change', 'Dr. Lisa Anderson', 5, 'Climate science and policy frameworks'],
    ['ENV302', 'Sustainable Energy Systems', 'Renewable energy technologies', 'Prof. Robert Taylor', 6, 'Sustainable energy solutions']
  ];

  courses.forEach(course => {
    db.run(`INSERT OR IGNORE INTO courses (code, name, description, instructor, semester, notes) VALUES (?, ?, ?, ?, ?, ?)`, course);
  });

  // Create sample admin if not exists
  const adminEmail = 'admin@environmental.edu';
  db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, user) => {
    if (!user) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
        ['Admin User', adminEmail, hashedPassword, 'admin']);
    }
  });
});

module.exports = db;