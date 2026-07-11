import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { cms } from "../lib.ts";
import { useSession } from "../auth.tsx";
import { Button, cardStyle, Empty, ErrorBox, Loading, Page } from "../ui.tsx";

export function PagesListPage() {
  const nav = useNavigate();
  const { data: session, isLoading: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading && !session) nav({ to: "/login" });
  }, [session, sessionLoading, nav]);

  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => cms.pages.list({ pageSize: 50 }),
    enabled: Boolean(session),
  });

  if (sessionLoading || !session) return <Page><Loading /></Page>;

  return (
    <Page>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Páginas</h1>
        <Button onClick={() => nav({ to: "/pages/new" })}>Nueva página</Button>
      </div>

      {pages.isLoading && <Loading />}
      {pages.isError && <ErrorBox error={pages.error} />}
      {pages.data && pages.data.data.length === 0 && (
        <Empty>Aún no hay páginas. Crea la primera con “Nueva página”.</Empty>
      )}
      {pages.data?.data.map((p) => (
        <div key={p.id} style={cardStyle}>
          <div>
            <strong>{p.title}</strong>{" "}
            <span style={{ fontSize: "0.8rem", color: p.status === "published" ? "#127c2b" : "#8a6d00" }}>
              {p.status}
            </span>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>{p.slug}</div>
          </div>
          <Link to="/pages/$pageId" params={{ pageId: p.id }} style={{ fontSize: "0.9rem" }}>
            Editar
          </Link>
        </div>
      ))}
    </Page>
  );
}
