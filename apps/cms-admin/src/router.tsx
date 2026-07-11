import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { useSession, useLogout } from "./auth.tsx";
import { LoginPage } from "./routes/login.tsx";
import { PagesListPage } from "./routes/pages-list.tsx";
import { NewPage } from "./routes/page-new.tsx";
import { EditPage } from "./routes/page-edit.tsx";
import { BuilderPage } from "./routes/page-builder.tsx";
import { MenusPage } from "./routes/menus.tsx";
import { SettingsPage } from "./routes/settings.tsx";

function Root() {
  const { data: session } = useSession();
  const logout = useLogout();
  const nav = useNavigate();
  return (
    <>
      {session && (
        <header style={{ borderBottom: "1px solid #eee", padding: "0.6rem 1rem", display: "flex", justifyContent: "space-between", fontFamily: "system-ui" }}>
          <nav style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <Link to="/" style={{ fontWeight: 700 }}>AstroCMS</Link>
            <Link to="/menus">Menús</Link>
            <Link to="/settings">Ajustes</Link>
          </nav>
          <span style={{ fontSize: "0.85rem" }}>
            {session.user.email}{" "}
            <button type="button" onClick={() => logout.mutate(undefined, { onSuccess: () => nav({ to: "/login" }) })}>
              salir
            </button>
          </span>
        </header>
      )}
      <Outlet />
    </>
  );
}

const rootRoute = createRootRoute({ component: Root });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: PagesListPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const newRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/new", component: NewPage });
const editRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/$pageId", component: EditPage });
const builderRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pages/$pageId/builder", component: BuilderPage });
const menusRoute = createRoute({ getParentRoute: () => rootRoute, path: "/menus", component: MenusPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, newRoute, editRoute, builderRoute, menusRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
