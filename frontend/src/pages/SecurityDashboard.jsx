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
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getSeverityColor = (severity) => {
    if (severity === 'high') return 'text-red-600 bg-red-100';
    if (severity === 'medium') return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Please login to view the security dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Security Dashboard</h1>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Emails</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEmails}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Phishing Detected</h3>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.phishingDetected}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Spam Detected</h3>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.spamDetected}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Anomalies</h3>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.anomaliesDetected}</p>
              </div>
            </div>

            {/* Recent Threats */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Recent Threats</h2>
              </div>
              <div className="p-6">
                {recentThreats.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent threats detected</p>
                ) : (
                  <div className="space-y-4">
                    {recentThreats.map((threat) => (
                      <div
                        key={threat._id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
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
                            <p className="text-sm text-gray-600">
                              From: {threat.sender?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(threat.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleMarkAsSafe(threat._id)}
                              className="text-sm text-green-600 hover:text-green-700 px-3 py-1 border border-green-600 rounded hover:bg-green-50"
                            >
                              Mark Safe
                            </button>
                            <button
                              onClick={() => handleMarkAsPhishing(threat._id)}
                              className="text-sm text-red-600 hover:text-red-700 px-3 py-1 border border-red-600 rounded hover:bg-red-50"
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
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Behavioral Anomalies</h2>
              </div>
              <div className="p-6">
                {anomalies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No behavioral anomalies detected</p>
                ) : (
                  <div className="space-y-3">
                    {anomalies.map((anomaly, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(anomaly.severity)}`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">{anomaly.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-700">{anomaly.message}</p>
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

