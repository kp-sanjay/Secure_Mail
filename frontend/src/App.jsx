import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Inbox from './pages/Inbox';
import Sent from './pages/Sent';
import Compose from './pages/Compose';
import ViewEmail from './pages/ViewEmail';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/inbox"
            element={
              <PrivateRoute>
                <Layout>
                  <Inbox />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/sent"
            element={
              <PrivateRoute>
                <Layout>
                  <Sent />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/compose"
            element={
              <PrivateRoute>
                <Layout>
                  <Compose />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/email/:id"
            element={
              <PrivateRoute>
                <Layout>
                  <ViewEmail />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/inbox" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

