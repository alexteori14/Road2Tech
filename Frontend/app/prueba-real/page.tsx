import { getHallazgosData } from '@/lib/data/loader';
import { PruebaRealView } from '@/components/prueba-real/PruebaRealView';

export default function PruebaRealPage() {
  const data = getHallazgosData();
  return <PruebaRealView data={data} />;
}
