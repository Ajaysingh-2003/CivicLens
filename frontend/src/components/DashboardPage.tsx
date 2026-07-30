import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, ZoomControl } from 'react-leaflet';
import { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import './Dashboard.css';
import { Bell, User, Map as MapIcon } from 'lucide-react';

export default function DashboardPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Define strict world bounds to prevent horizontal repeating and blank spaces on zoom out
  const worldBounds: LatLngBoundsExpression = [
    [-90, -180],
    [90, 180]
  ];

  useEffect(() => {
    async function loadIssues() {
      try {
        const data = await api.getMapIssues();
        
        // Guarantee format compatibility for hex colors that are missing the '#'
        const formattedData = data.map((issue: any) => ({
           ...issue,
           category_color: issue.category_color?.startsWith('#') 
              ? issue.category_color 
              : `#${issue.category_color}`
        }));

        setIssues(formattedData);
      } catch(e) {
        console.error(e);
      }
    }
    
    async function loadUser() {
      try {
        const u = await api.getMe();
        setUser(u);
      } catch(e) {
        console.error(e);
      }
    }

    loadIssues();
    loadUser();
  }, []);

  const handleMarkerClick = async (id: number) => {
    setLoadingIssue(true);
    try {
      const data = await api.getIssueDetails(id);
      setSelectedIssue(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingIssue(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.reload();
  };

  // Status map mapping
  const statusColors: Record<string, string> = {
    PENDING: '#6b7280',
    ASSIGNED: '#3b82f6',
    IN_PROGRESS: '#f59e0b',
    RESOLVED: '#10b981',
    REJECTED: '#ef4444'
  };

  const categoryStats = issues.reduce((acc, issue) => {
    const cat = issue.category_name || 'Uncategorized';
    if (!acc[cat]) {
      acc[cat] = {
        color: issue.category_color || '#6b7280',
        count: 0
      };
    }
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { color: string; count: number }>);

  return (
    <div className="dashboard-wrapper">
      <div className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Jantriva Logo" className="sidebar-logo" />
          <span>Jantriva</span>
        </div>
        
        <div className="sidebar-nav">
          <div className="nav-item active">
            <MapIcon size={20} />
            <span>Incidents</span>
          </div>
        </div>
      </div>

      <div className="main-content">
        <nav className="top-navbar">
          <div className="welcome-message">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--on-surface)' }}>
              Welcome, {user?.full_name || user?.name || "Citizen"}
            </h2>
          </div>
          <div className="nav-right">
            <Bell className="icon-btn" size={20} />
            <User className="icon-btn" size={24} onClick={handleLogout} />
          </div>
        </nav>

        <MapContainer 
          center={[20.5937, 78.9629]} 
          zoom={5} 
          minZoom={3} 
          maxBounds={worldBounds}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          className="full-map"
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri'
            noWrap={true}
            bounds={worldBounds}
          />
          <ZoomControl position="bottomright" />

          {issues.map(issue => (
            <CircleMarker 
              key={issue.id} 
              center={[issue.lat, issue.lng]}
              radius={8}
              pathOptions={{ 
                fillColor: issue.category_color || '#10b981', 
                color: 'white', 
                weight: 2, 
                fillOpacity: 1 
              }}
              eventHandlers={{ click: () => handleMarkerClick(issue.id) }}
            >
              <Tooltip>{issue.category_name} - {issue.status}</Tooltip>
              <Popup>
                  {loadingIssue ? <p>Loading details...</p> : (
                    selectedIssue && selectedIssue.id === issue.id ? (
                      <div className="popup-details">
                         <h4>{selectedIssue.title || selectedIssue.category_name}</h4>
                         <div style={{ marginBottom: '12px' }}>
                           <span 
                             className="status-pill" 
                             style={{ backgroundColor: statusColors[selectedIssue.status] || '#6b7280' }}
                           >
                             {selectedIssue.status.replace('_', ' ')}
                           </span>
                         </div>
                         <p>{selectedIssue.description || "No description provided."}</p>
                      </div>
                    ) : <p>Loading...</p>
                  )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Legend Overlay Floating on Map */}
        <div className="map-legend">
          <h3 className="legend-title">Incidents by Category</h3>
          <div className="legend-list">
            {Object.keys(categoryStats).map(category => (
              <div className="legend-item" key={category}>
                <div className="legend-dot" style={{ backgroundColor: categoryStats[category].color }}></div>
                <span className="legend-label">{category}</span>
                <span className="legend-count">{categoryStats[category].count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
