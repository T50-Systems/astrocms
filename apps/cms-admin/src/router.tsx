import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession, useLogout } from "./auth.tsx";
import { cms } from "./lib.ts";
import { DesignTokensBridge } from "@/components/design-tokens-bridge.tsx";
import { AppShell } from "./shell.tsx";
import { LoginPage } from "./routes/login.tsx";
import { PagesListPage } from "./routes/pages-list.tsx";
import { NewPage } from "./routes/page-new.tsx";
import { EditPage } from "./routes/page-edit.tsx";
import { BuilderPage } from "./routes/page-builder.tsx";
import { MediaPage } from "./routes/media.tsx";
import { MenusPage } from "./routes/menus.tsx";
import { SettingsPage } from "./routes/settings.tsx";
import { GuidelinesPage } from "./routes/guidelines.tsx";
import { TokensPage } from "./routes/tokens.tsx";
import { TagsPage } from "./routes/tags.tsx";
import { TaxonomiesPage } from "./routes/taxonomies.tsx";

function Root() {
  const { data: session } = useSession();
  const logout = useLogout();
  const nav = useNavigate();
  const siteSettings = useQuery({
    queryKey: ["settings", "site"],
    queryFn: () => cms.settings.get("site"),
    enabled: Boolean(session),
  });
  // Sin sesión (login): sin shell. Con sesión: layout tipo WordPress (barra superior + lateral).
  if (!session) {
    return <Outlet />;
  }
  const siteName = typeof siteSettings.data?.values.title === "string" && siteSettings.data.values.title.trim()
    ? siteSettings.data.values.title
    : "AstroCMS";
  return (
    <>
      {/* Aplica tokens DTCG (color.brand → --primary) al tema del panel. Requiere sesión. */}
      <DesignTokensBridge />
      <AppShell
        email={session.user.email}
        siteName={siteName}
        onLogout={() => logout.mutate(undefined, { onSuccess: () => nav({ to: "/login" }) })}
      >
        <Outlet />
      </AppShell>
    </>
  );
}

const rootRoute = createRootRoute({ component: Root });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: PagesListPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const newRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/new", component: NewPage });
const editRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/$pageId", component: EditPage });
const builderRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/$pageId/builder", component: BuilderPage });
const mediaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/media", component: MediaPage });
const menusRoute = createRoute({ getParentRoute: () => rootRoute, path: "/menus", component: MenusPage });
const taxonomiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/taxonomies", component: TaxonomiesPage });
const tagsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tags", component: TagsPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
const guidelinesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/guidelines", component: GuidelinesPage });
const tokensRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tokens", component: TokensPage });

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, newRoute, editRoute, builderRoute, mediaRoute, menusRoute, taxonomiesRoute, tagsRoute, settingsRoute, guidelinesRoute, tokensRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
