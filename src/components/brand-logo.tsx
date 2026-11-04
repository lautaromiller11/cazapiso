import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <>
      <Image
        src="/brand-lockup-light.png"
        alt="CazaPiso"
        width={202}
        height={57}
        className={`${className} dark:hidden`}
      />
      <Image
        src="/brand-lockup-dark.png"
        alt="CazaPiso"
        width={202}
        height={57}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
