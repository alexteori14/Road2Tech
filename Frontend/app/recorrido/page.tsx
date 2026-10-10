import { getHallazgosData } from '@/lib/data/loader';
import { RecorridoView } from '@/components/recorrido/RecorridoView';

export default function RecorridoPage() {
  const data = getHallazgosData();
  return <RecorridoView data={data} />;
}
