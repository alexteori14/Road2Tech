import { getHallazgosData } from '@/lib/data/loader';
import { AnaquelView } from '@/components/anaquel/AnaquelView';

export default function AnaquelPage() {
  const data = getHallazgosData();
  return <AnaquelView data={data} />;
}
