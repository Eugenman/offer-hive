import { Suspense } from "react";
import { ApplicationPage } from "@/components/applications/application-page";

async function ArchivedRoute({ params }: Pick<PageProps<"/archive/[id]">, "params">) {
  const { id } = await params;
  return <ApplicationPage id={id} section="archive" />;
}

export default function Page(props: PageProps<"/archive/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-16 border-b" />}>
      <ArchivedRoute params={props.params} />
    </Suspense>
  );
}
