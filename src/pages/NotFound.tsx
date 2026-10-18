import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

/** Unknown address: shown inside the shell so navigation stays available. */
const NotFound = () => {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <div className="pb-24">
      <PageHeader title={t("notFound.heading")}  />
      <EmptyState icon={Compass} title={t("notFound.body")} hint={t("notFound.message")} />
      <div className="mt-4 flex justify-center">
        <Button asChild><Link to="/">{t("notFound.returnHome")}</Link></Button>
      </div>
    </div>
  );
};

export default NotFound;
