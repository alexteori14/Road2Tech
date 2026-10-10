import { getRedData } from '@/lib/data/loader';
import { ImpactoView } from '@/components/impacto/ImpactoView';

export default function ImpactoPage() {
  const data = getRedData();
  return <ImpactoView data={data} />;
}
