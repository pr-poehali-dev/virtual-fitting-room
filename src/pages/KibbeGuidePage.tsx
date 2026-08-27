import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import KibbeGuide from '@/components/kibbe/KibbeGuide';

export default function KibbeGuidePage() {
  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <Link
            to="/kibbe-test"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-purple-700"
          >
            <Icon name="ChevronLeft" size={16} />
            Вернуться к тесту
          </Link>

          <KibbeGuide asPage />

          <div className="mt-10 text-center">
            <Link
              to="/kibbe-test"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700"
            >
              <Icon name="Ruler" size={18} />
              Пройти бесплатный тест
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}