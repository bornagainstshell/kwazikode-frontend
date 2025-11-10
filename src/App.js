import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './App.css';

const API_URL = 'https://kwazikode-backend.onrender.com/api';

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [view, setView] = useState('events');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Show notification function
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  useEffect(() => {
    // Check if user is logged in (from localStorage)
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      console.log('Loaded user from storage:', userData);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      console.log('Loading events...');
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
        console.log('Events loaded:', data.events.length);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, []);

  const loadMyTickets = useCallback(async () => {
    if (!user || !user.id) {
      console.log('No user ID available for loading tickets');
      return;
    }
    
    try {
      console.log('Loading tickets for user:', user.id);
      const response = await fetch(`${API_URL}/tickets/user/${user.id}`);
      const data = await response.json();
      if (data.success) {
        setMyTickets(data.tickets);
        console.log('Tickets loaded:', data.tickets.length);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id) {
      console.log('User authenticated, loading data...');
      loadEvents();
      loadMyTickets();
    }
  }, [user, loadEvents, loadMyTickets]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setAuthLoading(true);
    try {
      console.log('Google login successful, decoding token...');
      const decoded = jwtDecode(credentialResponse.credential);
      console.log('Decoded Google token:', decoded);
      
      // Register/login user in backend
      console.log('Sending to backend for authentication...');
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: decoded.email,
          name: decoded.name,
          googleId: decoded.sub
        })
      });

      const data = await response.json();
      console.log('Backend auth response:', data);
      
      if (data.success) {
        console.log('Authentication successful, user:', data.user);
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Check if user is admin
        if (data.user.is_admin) {
          console.log('User is admin');
          showNotification('Welcome Admin! You can access the admin dashboard.', 'info');
        } else {
          showNotification('Login successful! Welcome to EventTicket.', 'success');
        }
      } else {
        showNotification('Authentication failed: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showNotification('Login failed. Please try again.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const purchaseTicket = async (eventId) => {
    if (!user || !user.id) {
      showNotification('Please login first to purchase tickets', 'error');
      return;
    }

    setLoading(true);
    try {
      console.log('Purchasing ticket for event:', eventId, 'User:', user.id);
      
      const response = await fetch(`${API_URL}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          eventId: eventId
        })
      });

      const data = await response.json();
      console.log('Purchase response:', data);
      
      if (data.success) {
        showNotification('Ticket purchased successfully! Check "My Tickets" to view your QR code.', 'success');
        // Reload events and tickets
        loadEvents();
        loadMyTickets();
      } else {
        showNotification(data.error || 'Failed to purchase ticket', 'error');
      }
    } catch (error) {
      console.error('Error purchasing ticket:', error);
      showNotification('Failed to purchase ticket. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('Logging out user');
    setUser(null);
    setEvents([]);
    setMyTickets([]);
    localStorage.removeItem('user');
    showNotification('Logged out successfully', 'info');
  };

  // Close notification
  const closeNotification = () => {
    setNotification({ show: false, message: '', type: '' });
  };

  // Show login screen by default if no user
  if (!user) {
    return (
      <div className="login-container">
        {/* Notification Popup */}
        {notification.show && (
          <div className={`notification ${notification.type}`}>
            <span>{notification.message}</span>
            <button onClick={closeNotification} className="close-notification">×</button>
          </div>
        )}
        
        <div className="login-box">
          <h1>🎟️ EventTicket MVP</h1>
          <p>Login with Google to get your free tickets</p>
          {authLoading ? (
            <div className="loading">Authenticating...</div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                console.error('Google login failed');
                showNotification('Google login failed', 'error');
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Notification Popup */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={closeNotification} className="close-notification">×</button>
        </div>
      )}
      
      <header>
        <h1>🎟️ EventTicket</h1>
        <div className="user-info">
          <span>Welcome, {user.name}! {user.is_admin && '(Admin)'}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <nav>
        <button 
          className={view === 'events' ? 'active' : ''} 
          onClick={() => setView('events')}
        >
          Available Events
        </button>
        <button 
          className={view === 'tickets' ? 'active' : ''} 
          onClick={() => setView('tickets')}
        >
          My Tickets ({myTickets.length})
        </button>
        {user.is_admin && (
          <button 
            className="admin-btn"
            onClick={() => window.open('http://localhost:3001', '_blank')}
          >
            🛠️ Admin Dashboard
          </button>
        )}
      </nav>

      <main>
        {view === 'events' ? (
          <div className="events-grid">
            {events.length === 0 ? (
              <p className="no-events">Loading events...</p>
            ) : (
              events.map(event => (
                <div key={event.id} className="event-card">
                  <h2>{event.name}</h2>
                  <p className="description">{event.description}</p>
                  <div className="event-details">
                    <p>📅 {new Date(event.date).toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                    <p>📍 {event.venue}</p>
                    <p className="price">R {event.price.toFixed(2)}</p>
                    <p className="tickets-left">
                      {event.available_tickets} / {event.total_tickets} tickets left
                    </p>
                  </div>
                  <button 
                    onClick={() => purchaseTicket(event.id)}
                    disabled={loading || event.available_tickets === 0}
                    className="purchase-btn"
                  >
                    {loading ? 'Processing...' : event.available_tickets === 0 ? 'Sold Out' : 'Get Ticket'}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="tickets-container">
            {myTickets.length === 0 ? (
              <p className="no-tickets">No tickets yet. Get your first ticket from Available Events!</p>
            ) : (
              myTickets.map(ticket => (
                <div key={ticket.id} className="ticket-card">
                  <h2>{ticket.events?.name || 'Event'}</h2>
                  <p>📅 {new Date(ticket.events?.date).toLocaleString('en-ZA')}</p>
                  <p>📍 {ticket.events?.venue || 'Venue'}</p>
                  <div className="qr-code">
                    <img src={ticket.qrCodeImage} alt="QR Code" />
                  </div>
                  {ticket.is_validated && (
                    <div className="validated">
                      ✅ Validated on {new Date(ticket.validated_at).toLocaleString('en-ZA')}
                    </div>
                  )}
                  <p className="ticket-info">Show this QR code at the event entrance</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;