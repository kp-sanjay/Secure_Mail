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
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="portal-card p-8 text-center">
            <p className="text-gray-300 mb-4">Please login to view your drafts</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="portal-card">
          <div className="px-6 py-4 border-b border-forest-500/20">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-gray-100">Drafts</h1>
              <button
                onClick={() => navigate('/compose')}
                className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
              >
                New Draft
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">Loading drafts...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">No drafts saved</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {drafts.map((draft) => (
                <div
                  key={draft._id}
                  className="px-6 py-4 hover:bg-white/5 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-100">
                          To: {draft.receiver?.email || 'Unknown'}
                        </p>
                        <span className="text-xs bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded border border-yellow-500/30">
                          Draft
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">
                        [Draft - Click to edit]
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-400">{formatDate(draft.timestamp)}</p>
                      <button
                        onClick={() => handleEditDraft(draft)}
                        className="text-forest-300 hover:text-forest-400 text-sm px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft._id)}
                        className="text-red-300 hover:text-red-200 text-sm px-2 py-1 rounded"
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

