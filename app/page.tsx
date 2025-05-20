import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThreeDScene } from '@/components/3d-scene';

export default function Home() {
  return (
    <SidebarProvider className="h-screen">
      <AppSidebar variant="inset" />
      <SidebarInset className="h-full flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col h-full">
          <div className="@container/main flex flex-1 flex-col gap-2 h-full">
            <div className="flex flex-col gap-4 md:gap-6 h-full">
              <ThreeDScene />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
