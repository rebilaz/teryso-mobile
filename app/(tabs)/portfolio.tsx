import {
    PortfolioLayout,
} from '@/components/portfolio/portfolio-layout';
import {
    PortfolioSwipeProvider,
} from '@/components/portfolio/portfolio-swipe-context';

export default function PortfolioScreen() {
  return (
    <PortfolioSwipeProvider>
      <PortfolioLayout />
    </PortfolioSwipeProvider>
  );
}