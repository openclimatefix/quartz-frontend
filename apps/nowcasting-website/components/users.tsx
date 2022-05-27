interface IUsers {}

const users = [
  {
    name: "Grid Operators",
    icon: "electric-pole",
  },
  {
    name: "Solar Farms",
    icon: "solar-panels",
  },
  {
    name: "Electricity Traders",
    icon: "bolt",
  },
  {
    name: "Battery Operators",
    icon: "lighting",
  },
  {
    name: "Smart Homes",
    icon: "home-automation",
  },
];

const Users = ({}: IUsers) => {
  return (
    <ul className="grid grid-cols-3 gap-10">
      {users.map(({ name, icon }) => (
        <li key={name}>
          <figure>
            <img
              className="w-20 h-20 mx-auto"
              src={`/icons/${icon}.svg`}
              alt=""
            />
            <figcaption className="mt-2 text-center">{name}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
};

export default Users;
