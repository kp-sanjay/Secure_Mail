import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Inbox from './pages/Inbox';
import Sent from './pages/Sent';
import Compose from './pages/Compose';
import ViewEmail from './pages/ViewEmail';
import Drafts from './pages/Drafts';
import SecurityDashboard from './pages/SecurityDashboard';
import ThreadView from './pages/ThreadView';
import Assistant from './pages/Assistant';
import Calendar from './pages/Calendar';
import Messages from './pages/Messages';
import Call from './pages/Call';
import HexagonBackground from './components/HexagonBackground';

const PrivateRoute = ({ children }) => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <div className="relative min-h-screen">
            <HexagonBackground
              glowColor="rgba(34, 211, 238, 0.55)"
              borderColor="rgba(15, 23, 42, 0.85)"
            />
            <div className="relative">
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
                  <Route
                    path="/drafts"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Drafts />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <SecurityDashboard />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/thread/:threadId"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <ThreadView />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/assistant"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Assistant />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Calendar />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Messages />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/call"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Call />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/inbox" />} />
                </Routes>
              </Router>
            </div>
          </div>
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

