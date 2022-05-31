interface IUsers {}

const users = [
  {
    name: "Grid Operators",
    icon: "electric-pole",
    className: "",
  },
  {
    name: "Solar Farms",
    icon: "solar-panels",
    className: "",
  },
  {
    name: "Electricity Traders",
    icon: "bolt",
    className: "",
  },
  {
    name: "Battery Operators",
    icon: "lighting",
    className: "col-start-2",
  },
  {
    name: "Smart Homes",
    icon: "eco-house",
    className: "",
  },
];

const Users = ({}: IUsers) => {
  return (
    <ul className="grid grid-cols-6 gap-10">
      {users.map(({ name, icon, className }) => (
        <li key={name} className={`col-span-2 ${className}`}>
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
