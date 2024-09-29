"use client"
import { useState } from 'react';

export default function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [getMessage, setGetMessage] = useState('');

  const callApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api', {
        method: 'POST', // You can also use GET depending on your API's requirement
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ /* any data you want to send */ }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Success: ${data.status}, Message: ${data.message}, Full Info: ${data?.full_info}`);
      } else {
        setMessage(`Error: ${data.status}, Message: ${data.message}, Full Info: ${data?.full_info}`);
      }
    } catch (error) {
      console.error('Error calling the API:', error);
      setMessage('Error calling the API');
    } finally {
      setLoading(false);
    }
  };

  const getAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api', {
        method: 'GET', // You can also use GET depending on your API's requirement
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include"
      });
      const data = await response.json();
      if (response.ok) {
        setGetMessage(`Success: ${data.status}, Token Keys: ${data?.token_info}, Error: ${data?.supa_error}`);
      } else {
        setGetMessage(`Success: ${data.status}, Token Keys: ${data?.token_info}, Error: ${data?.supa_error}`);
      }
    } catch (error) {
      console.error('Error calling the get API:', error);
      setMessage('Error calling the API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={callApi} disabled={loading}>
        {loading ? 'Loading...' : 'Call API'}
      </button>
      <button onClick={getAPI} disabled={loading}>
        {loading ? 'Loading...' : 'GET API'}
      </button>
      {message && <p>{message}</p>}
      {getMessage && <p>{getMessage}</p>}
    </div>
  );
}
