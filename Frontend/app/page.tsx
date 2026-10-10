import { getHallazgosData } from '@/lib/data/loader';
import { ResumenView } from '@/components/resumen/ResumenView';

export default function HomePage() {
  const data = getHallazgosData();
  return <ResumenView data={data} />;
}
