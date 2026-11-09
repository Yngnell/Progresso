import PageHeader from '../../components/PageHeader';
import SettingsTabs from '../../components/settings/SettingsTabs';

// Settings in the admin panel: every signed-in SK account.
export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" description="Your profile, your password and, for the SK Chairperson, the system." />
      <div className="mt-6">
        <SettingsTabs />
      </div>
    </div>
  );
}
