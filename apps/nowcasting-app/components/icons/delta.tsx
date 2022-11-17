import React from "react";

type DeltaIconProps = {
	className?: string;
};

export const UpArrow: React.FC<DeltaIconProps> = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		height="32"
		id="triangle-up"
		viewBox="0 0 32 32"
		width="32"
	>
		<path d="M4 24 H28 L16 6 z" />
	</svg>
);

export const DownArrow: React.FC<DeltaIconProps> = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		height="32"
		id="triangle-down"
		viewBox="0 0 32 32"
		width="32"
	>
		<path d="M4 8 H28 L16 26 z" />
	</svg>
);
