import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CartProvider } from './cart.jsx';
import { ToastProvider } from './toast.jsx';
import { trpc, trpcClient } from './trpc.ts';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: (count, error) => !['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST'].includes(error?.data?.code) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </ToastProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </BrowserRouter>
  </React.StrictMode>
);
