import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';

const Drafts = () => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchDrafts();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getDrafts();
      setDrafts(response.data);
    } catch (err) {
      setError('Failed to load drafts');
      console.error('Error fetching drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDraft = (draft) => {
    navigate('/compose', { state: { draft } });
  };

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    try {
      await emailAPI.deleteDraft(draftId);
      setDrafts(drafts.filter((d) => d._id !== draftId));
    } catch (err) {
      alert('Failed to delete draft');
      console.error('Error deleting draft:', err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Please login to view your drafts</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
              <button
                onClick={() => navigate('/compose')}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
              >
                New Draft
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Loading drafts...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No drafts saved</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {drafts.map((draft) => (
                <div
                  key={draft._id}
                  className="px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-900">
                          To: {draft.receiver?.email || 'Unknown'}
                        </p>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Draft
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        [Draft - Click to edit]
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-500">{formatDate(draft.timestamp)}</p>
                      <button
                        onClick={() => handleEditDraft(draft)}
                        className="text-primary-600 hover:text-primary-700 text-sm px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft._id)}
                        className="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Drafts;

