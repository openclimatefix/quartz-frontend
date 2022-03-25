// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import data20200807 from "../../data/2020-08-07/generation-mix.json";
import data20210305 from "../../data/2021-03-05/generation-mix.json";
import data20210309 from "../../data/2021-03-09/generation-mix.json";
import data20210610 from "../../data/2021-06-10/generation-mix.json";
import data20211008 from "../../data/2021-10-08/generation-mix.json";

export default function handler(req, res) {
  const { date, shape } = req.query;

  console.log(date);
  console.log(shape);
  console.log("HIIIIIIIIIIII");

  const dateLookup = {
    "2020-08-07": data20200807,
    "2021-03-05": data20210305,
    "2021-03-09": data20210309,
    "2021-06-10": data20210610,
    "2021-10-08": data20211008,
  };

  console.log(dateLookup[date]);

  return res.status(200).json(dateLookup[date]);
}
