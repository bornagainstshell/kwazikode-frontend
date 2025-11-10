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
  const [purchasingEventId, setPurchasingEventId] = useState(null);

  // Show notification function
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, []);

  const loadMyTickets = useCallback(async () => {
    if (!user || !user.id) return;
    
    try {
      const response = await fetch(`${API_URL}/tickets/user/${user.id}`);
      const data = await response.json();
      if (data.success) {
        setMyTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id) {
      loadEvents();
      loadMyTickets();
    }
  }, [user, loadEvents, loadMyTickets]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setAuthLoading(true);
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      
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
      
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (data.user.is_admin) {
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

    setPurchasingEventId(eventId);
    setLoading(true);
    
    // Show initial loading message
    showNotification('🔄 Starting ticket purchase... This may take a moment.', 'info');

    try {
      const response = await fetch(`${API_URL}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          eventId: eventId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification('✅ Ticket purchased successfully! Check "My Tickets" for your QR code.', 'success');
        loadEvents();
        loadMyTickets();
      } else {
        showNotification(data.error || 'Failed to purchase ticket', 'error');
      }
    } catch (error) {
      console.error('Error purchasing ticket:', error);
      showNotification('❌ Failed to purchase ticket. Please try again.', 'error');
    } finally {
      setLoading(false);
      setPurchasingEventId(null);
    }
  };

  const cancelTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to cancel this ticket?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/tickets/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticketId,
          userId: user.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification('✅ Ticket cancelled successfully!', 'success');
        loadEvents();
        loadMyTickets();
      } else {
        showNotification(data.error || 'Failed to cancel ticket', 'error');
      }
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      showNotification('❌ Failed to cancel ticket. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setEvents([]);
    setMyTickets([]);
    localStorage.removeItem('user');
    showNotification('Logged out successfully', 'info');
  };

  const closeNotification = () => {
    setNotification({ show: false, message: '', type: '' });
  };

  if (!user) {
    return (
      <div className="login-container">
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
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Authenticating...</p>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => showNotification('Google login failed', 'error')}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
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
        <button className={view === 'events' ? 'active' : ''} onClick={() => setView('events')}>
          Available Events
        </button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={() => setView('tickets')}>
          My Tickets ({myTickets.length})
        </button>
        {user.is_admin && (
          <button className="admin-btn" onClick={() => window.open('https://your-admin-url.vercel.app', '_blank')}>
            🛠️ Admin Dashboard
          </button>
        )}
      </nav>

      <main>
        {view === 'events' ? (
          <div className="events-grid">
            {events.length === 0 ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading events...</p>
              </div>
            ) : (
              events.map(event => (
                <div key={event.id} className="event-card">
                  <h2>{event.name}</h2>
                  <p className="description">{event.description}</p>
                  <div className="event-details">
                    <p>📅 {new Date(event.date).toLocaleDateString('en-ZA', {
                      weekday: 'long', year: 'numeric', month: 'long', 
                      day: 'numeric', hour: '2-digit', minute: '2-digit'
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
                    className={`purchase-btn ${purchasingEventId === event.id ? 'purchasing' : ''}`}
                  >
                    {purchasingEventId === event.id ? (
                      <>
                        <div className="spinner-small"></div>
                        Processing...
                      </>
                    ) : event.available_tickets === 0 ? (
                      'Sold Out'
                    ) : (
                      'Get Ticket'
                    )}
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
                  <div className="ticket-header">
                    <h2>{ticket.events?.name || 'Event'}</h2>
                    {!ticket.is_validated && (
                      <button 
                        onClick={() => cancelTicket(ticket.id)}
                        disabled={loading}
                        className="cancel-btn"
                      >
                        ❌ Cancel
                      </button>
                    )}
                  </div>
                  <p>📅 {new Date(ticket.events?.date).toLocaleString('en-ZA')}</p>
                  <p>📍 {ticket.events?.venue || 'Venue'}</p>
                  <div className="qr-code">
                    <img src={ticket.qrCodeImage} alt="QR Code" />
                  </div>
                  {ticket.is_validated ? (
                    <div className="validated">
                      ✅ Validated on {new Date(ticket.validated_at).toLocaleString('en-ZA')}
                    </div>
                  ) : (
                    <p className="ticket-info">Show this QR code at the event entrance</p>
                  )}
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