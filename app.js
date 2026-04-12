// Common JavaScript functions for all pages

// Check authentication status
async function checkAuth() {
  try {
    const response = await fetch('/me');
    if (response.ok) {
      const user = await response.json();
      return user;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Logout function
async function logout() {
  try {
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Display alert messages
function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.container');
  if (container) {
    container.insertBefore(alertDiv, container.firstChild);
    setTimeout(() => alertDiv.remove(), 3000);
  }
}

// Load notices
async function loadNotices(containerId) {
  try {
    const response = await fetch('/api/notices');
    const notices = await response.json();
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (notices.length === 0) {
      container.innerHTML = '<p>No notices available.</p>';
      return;
    }
    
    container.innerHTML = notices.map(notice => `
      <div class="notice-card">
        <div class="notice-title">${escapeHtml(notice.title)}</div>
        <div class="notice-content">${escapeHtml(notice.content)}</div>
        <div class="notice-date">Posted on: ${new Date(notice.created_at).toLocaleDateString()}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading notices:', error);
  }
}

// Load courses
async function loadCourses(containerId) {
  try {
    const response = await fetch('/api/courses');
    const courses = await response.json();
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = courses.map(course => `
      <div class="card">
        <h3>${escapeHtml(course.code)}: ${escapeHtml(course.name)}</h3>
        <p><strong>Instructor:</strong> ${escapeHtml(course.instructor)}</p>
        <p><strong>Semester:</strong> ${course.semester}</p>
        <p>${escapeHtml(course.description)}</p>
        ${course.notes ? `<p><strong>Notes:</strong> ${escapeHtml(course.notes)}</p>` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading courses:', error);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize navbar with auth state
async function initNavbar() {
  const user = await checkAuth();
  const navbarMenu = document.querySelector('.navbar-menu');
  
  if (navbarMenu && user) {
    const logoutLink = document.createElement('li');
    logoutLink.innerHTML = `<a href="#" onclick="logout(); return false;">Logout (${escapeHtml(user.name)})</a>`;
    navbarMenu.appendChild(logoutLink);
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
});