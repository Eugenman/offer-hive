import { Suspense } from "react";
import { ApplicationPage } from "@/components/applications/application-page";

async function ApplicationRoute({ params }: Pick<PageProps<"/applications/[id]">, "params">) {
  const { id } = await params;
  return <ApplicationPage id={id} />;
}

export default function Page(props: PageProps<"/applications/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-16 border-b" />}>
      <ApplicationRoute params={props.params} />
    </Suspense>
  );
}
