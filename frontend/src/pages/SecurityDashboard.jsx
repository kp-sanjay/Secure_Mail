import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { phishingDetector } from '../utils/phishingDetector';
import { anomalyDetector } from '../utils/anomalyDetector';
import { storeBehavioralEvent, getBehavioralEvents } from '../utils/localDB';

const SecurityDashboard = () => {
  const [stats, setStats] = useState({
    totalEmails: 0,
    phishingDetected: 0,
    spamDetected: 0,
    anomaliesDetected: 0,
    recentThreats: [],
  });
  const [loading, setLoading] = useState(true);
  const [recentThreats, setRecentThreats] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get all emails
      const inboxRes = await emailAPI.getInbox();
      const sentRes = await emailAPI.getSent();
      const allEmails = [...inboxRes.data, ...sentRes.data];

      // Analyze emails
      const phishingCount = allEmails.filter((e) => e.category === 'phishing').length;
      const spamCount = allEmails.filter((e) => e.category === 'spam').length;
      
      // Get recent threats
      const threats = allEmails
        .filter((e) => e.securityScore !== null && e.securityScore < 50)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

      // Get behavioral anomalies
      const behavioralEvents = await getBehavioralEvents('email_sent', 50);
      const anomalyResults = behavioralEvents.map((event) => {
        return anomalyDetector.detectAnomalies({
          type: 'email_sent',
          ...event.data,
        });
      }).filter((result) => result.hasAnomalies);

      setStats({
        totalEmails: allEmails.length,
        phishingDetected: phishingCount,
        spamDetected: spamCount,
        anomaliesDetected: anomalyResults.length,
        recentThreats: threats,
      });

      setRecentThreats(threats);
      setAnomalies(anomalyResults.flatMap((r) => r.anomalies));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSafe = async (emailId) => {
    try {
      await emailAPI.updateEmailCategory(emailId, 'legit');
      loadDashboardData();
    } catch (error) {
      console.error('Error marking as safe:', error);
      alert('Failed to update email category');
    }
  };

  const handleMarkAsPhishing = async (emailId) => {
    try {
      await emailAPI.updateEmailCategory(emailId, 'phishing');
      // Retrain model with user feedback
      const email = recentThreats.find((e) => e._id === emailId);
      if (email) {
        phishingDetector.retrainWithFeedback(email, 'phishing');
      }
      loadDashboardData();
    } catch (error) {
      console.error('Error marking as phishing:', error);
      alert('Failed to update email category');
    }
  };

  const getRiskColor = (score) => {
    if (score >= 70) return 'text-red-200 bg-red-500/20 border border-red-500/30';
    if (score >= 40) return 'text-yellow-200 bg-yellow-500/20 border border-yellow-500/30';
    return 'text-forest-200 bg-forest-500/20 border border-forest-500/30';
  };

  const getSeverityColor = (severity) => {
    if (severity === 'high') return 'text-red-200 bg-red-500/20 border border-red-500/30';
    if (severity === 'medium') return 'text-yellow-200 bg-yellow-500/20 border border-yellow-500/30';
    return 'text-cyan-200 bg-cyan-500/20 border border-cyan-500/30';
  };

  if (!user) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="portal-card p-8 text-center">
            <p className="text-gray-300">Please login to view the security dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Security Dashboard</h1>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-300">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="portal-card p-6">
                <h3 className="text-sm font-medium text-gray-300">Total Emails</h3>
                <p className="text-3xl font-bold text-gray-100 mt-2">{stats.totalEmails}</p>
              </div>
              <div className="portal-card p-6">
                <h3 className="text-sm font-medium text-gray-300">Phishing Detected</h3>
                <p className="text-3xl font-bold text-red-400 mt-2">{stats.phishingDetected}</p>
              </div>
              <div className="portal-card p-6">
                <h3 className="text-sm font-medium text-gray-300">Spam Detected</h3>
                <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.spamDetected}</p>
              </div>
              <div className="portal-card p-6">
                <h3 className="text-sm font-medium text-gray-300">Anomalies</h3>
                <p className="text-3xl font-bold text-orange-400 mt-2">{stats.anomaliesDetected}</p>
              </div>
            </div>

            {/* Recent Threats */}
            <div className="portal-card mb-8">
              <div className="px-6 py-4 border-b border-forest-500/20">
                <h2 className="text-lg font-bold text-gray-100">Recent Threats</h2>
              </div>
              <div className="p-6">
                {recentThreats.length === 0 ? (
                  <p className="text-gray-300 text-center py-4">No recent threats detected</p>
                ) : (
                  <div className="space-y-4">
                    {recentThreats.map((threat) => (
                      <div
                        key={threat._id}
                        className="border border-forest-500/15 rounded p-4 hover:bg-white/5 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(threat.securityScore)}`}>
                                Risk: {threat.securityScore}%
                              </span>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                threat.category === 'phishing' ? 'bg-red-100 text-red-800' :
                                threat.category === 'spam' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {threat.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">
                              From: {threat.sender?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(threat.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleMarkAsSafe(threat._id)}
                              className="text-sm text-forest-300 hover:text-forest-400 px-3 py-1 border border-forest-500/50 rounded hover:bg-white/5 transition"
                            >
                              Mark Safe
                            </button>
                            <button
                              onClick={() => handleMarkAsPhishing(threat._id)}
                              className="text-sm text-red-300 hover:text-red-200 px-3 py-1 border border-red-500/60 rounded hover:bg-white/5 transition"
                            >
                              Mark Phishing
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Behavioral Anomalies */}
            <div className="portal-card">
              <div className="px-6 py-4 border-b border-forest-500/20">
                <h2 className="text-lg font-bold text-gray-100">Behavioral Anomalies</h2>
              </div>
              <div className="p-6">
                {anomalies.length === 0 ? (
                  <p className="text-gray-300 text-center py-4">No behavioral anomalies detected</p>
                ) : (
                  <div className="space-y-3">
                    {anomalies.map((anomaly, index) => (
                      <div
                        key={index}
                        className="border border-forest-500/15 rounded p-4"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(anomaly.severity)}`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-300">{anomaly.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-200">{anomaly.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;

