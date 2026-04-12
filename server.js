const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  secret: 'environmental_engineering_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
      if (err || !user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    });
  };
};

// API Routes

// Signup
app.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        req.session.userId = this.lastID;
        req.session.userRole = role;
        
        res.status(201).json({ 
          message: 'User created successfully',
          user: { id: this.lastID, name, email, role }
        });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.userRole = user.role;
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

// Get current user
app.get('/me', requireAuth, (req, res) => {
  db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get all courses
app.get('/api/courses', (req, res) => {
  db.all('SELECT * FROM courses ORDER BY semester, code', [], (err, courses) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(courses);
  });
});

// Get notices
app.get('/api/notices', (req, res) => {
  const userId = req.session.userId;
  let query = 'SELECT n.*, u.name as author FROM notices n LEFT JOIN users u ON n.created_by = u.id';
  
  if (userId) {
    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
      if (user && user.role === 'admin') {
        query += ' ORDER BY n.created_at DESC';
      } else {
        query += ' WHERE n.target_role IS NULL OR n.target_role = ? ORDER BY n.created_at DESC';
        return db.all(query, [user?.role], (err, notices) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          res.json(notices);
        });
      }
      
      db.all(query, [], (err, notices) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(notices);
      });
    });
  } else {
    query += ' WHERE n.target_role IS NULL ORDER BY n.created_at DESC';
    db.all(query, [], (err, notices) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(notices);
    });
  }
});

// Add notice (admin only)
app.post('/api/notices', requireRole(['admin']), (req, res) => {
  const { title, content, target_role } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  db.run('INSERT INTO notices (title, content, target_role, created_by) VALUES (?, ?, ?, ?)',
    [title, content, target_role || null, req.session.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ message: 'Notice added successfully', id: this.lastID });
    });
});

// Delete notice (admin only)
app.delete('/api/notices/:id', requireRole(['admin']), (req, res) => {
  db.run('DELETE FROM notices WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Notice deleted successfully' });
  });
});

// Update course notes (staff and admin)
app.put('/api/courses/:id', requireRole(['staff', 'admin']), (req, res) => {
  const { notes } = req.body;
  
  db.run('UPDATE courses SET notes = ? WHERE id = ?', [notes, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Course updated successfully' });
  });
});

// Get all users (admin only)
app.get('/api/users', requireRole(['admin']), (req, res) => {
  db.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Delete user (admin only)
app.delete('/api/users/:id', requireRole(['admin']), (req, res) => {
  if (req.params.id == req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});