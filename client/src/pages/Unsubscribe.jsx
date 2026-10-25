import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Button } from '../components/ui';
import AuthShell from '../components/AuthShell';

// Landing page of the "Stop these emails" link in every update email. One click confirms,
// so a mail program that previews the link cannot unsubscribe anyone by accident.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('idle'); // idle | busy | done | error
  const [message, setMessage] = useState('');

  async function confirm() {
    setState('busy');
    try {
      const res = await api.post('/auth/unsubscribe', { token });
      setMessage(res.data.message);
      setState('done');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <AuthShell
      title="Stop update emails"
      description="You will no longer get news, event and project emails from the SK."
    >
      {state === 'done' ? (
        <p className="rounded-lg bg-green-50 px-3 py-2.5 font-medium text-green-800" role="status">
          {message} You can still read everything on the website.
        </p>
      ) : (
        <div className="space-y-4">
          {state === 'error' && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 font-medium text-red-700" role="alert">
              {message}
            </p>
          )}
          {!token ? (
            <p className="text-slate-700">This link is not valid.</p>
          ) : (
            <Button variant="primary" size="lg" onClick={confirm} disabled={state === 'busy'}>
              {state === 'busy' ? 'Working…' : 'Yes, stop the emails'}
            </Button>
          )}
        </div>
      )}
      <p className="mt-5 text-slate-600">
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/">
          Back to the website
        </Link>
      </p>
    </AuthShell>
  );
}
