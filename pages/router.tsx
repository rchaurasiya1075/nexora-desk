import type { AnyComponent } from "@tanstack/react-router";
import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { FirebaseAuthProvider } from "@/lib/firebase/session";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import { Home } from "@/routes/index";
import { TradePage } from "@/routes/trade";
import { LoginPage } from "@/routes/login";
import { AdminPage } from "@/routes/admin";
import { AdminLoginPage } from "@/routes/admin.login";
import { AccountPage } from "@/routes/account";
import { MarketsPage } from "@/routes/markets";
import { NewsPage } from "@/routes/news";
import { PricingPage } from "@/routes/pricing";

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <FirebaseAuthProvider>
        <PreviewHostBridge />
        <Outlet />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#121316",
              border: "1px solid rgba(242,241,237,0.12)",
              color: "#F2F1ED",
            },
          }}
        />
      </FirebaseAuthProvider>
    </AuthProvider>
  ),
});

function page(path: string, component: AnyComponent) {
  return createRoute({ getParentRoute: () => rootRoute, path, component });
}

const routeTree = rootRoute.addChildren([
  page("/", Home),
  page("/trade", TradePage),
  page("/login", LoginPage),
  page("/admin/login", AdminLoginPage),
  page("/admin", AdminPage),
  page("/account", AccountPage),
  page("/markets", MarketsPage),
  page("/news", NewsPage),
  page("/pricing", PricingPage),
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});
