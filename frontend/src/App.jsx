import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ModalProvider } from './context/ModalContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <SocketProvider>
          <ModalProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ModalProvider>
        </SocketProvider>
      </AuthProvider>
    </Provider>
  );
}

export default App;
