import { useState } from "react";
import { AdminShell, type TabId } from "./AdminShell";
import { ProductsTab } from "./tabs/ProductsTab";
import { FrameworksTab } from "./tabs/FrameworksTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { DeployTab } from "./tabs/DeployTab";
import { AuditTab } from "./tabs/AuditTab";

export function Dashboard() {
  const [tab, setTab] = useState<TabId>("products");

  return (
    <AdminShell active={tab} onChange={setTab}>
      {tab === "products" ? <ProductsTab /> : null}
      {tab === "frameworks" ? <FrameworksTab /> : null}
      {tab === "documents" ? <DocumentsTab /> : null}
      {tab === "images" ? <ImagesTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
      {tab === "deploy" ? <DeployTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}
    </AdminShell>
  );
}
