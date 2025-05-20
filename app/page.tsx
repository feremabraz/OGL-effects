import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { EffectsList } from '@/components/effects-list';

const formatEffectName = (name: string) => {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function Home() {
  return (
    <SidebarProvider className="h-screen">
      <AppSidebar variant="inset" />
      <SidebarInset className="h-full flex flex-col">
        <SiteHeader />
        <EffectsList className="mt-12" />
      </SidebarInset>
    </SidebarProvider>
  );
}
