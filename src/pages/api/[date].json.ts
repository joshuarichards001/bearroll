import type { APIRoute, GetStaticPaths } from "astro";
import { getAllDayDates, loadDay } from "../../lib/posts";

export const getStaticPaths: GetStaticPaths = () => {
  return getAllDayDates().map((date) => ({ params: { date } }));
};

export const GET: APIRoute = ({ params }) => {
  const day = loadDay(params.date!);
  if (!day) {
    return new Response("[]", {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(day.posts), {
    headers: { "Content-Type": "application/json" },
  });
};
