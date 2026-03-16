import Wizard from '@/components/wizard/Wizard';

export default async function WizardPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <Wizard sessionId={sessionId} />;
}
