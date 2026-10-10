import { getHallazgosData } from '@/lib/data/loader';
import { HallazgosView } from '@/components/hallazgos/HallazgosView';

export default function HallazgosPage() {
  const data = getHallazgosData();
  return <HallazgosView data={data} />;
}
