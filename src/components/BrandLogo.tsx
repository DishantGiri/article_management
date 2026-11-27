interface BrandLogoProps {
  className?: string;
  forceLight?: boolean;
}

export default function BrandLogo({
  className = "h-14 w-auto",
  forceLight = false,
}: BrandLogoProps) {
  return (
    <>
      <img
        src="/article-flow-writing-light.svg"
        alt="Article Flow"
        className={
          forceLight
            ? `${className} block select-none`
            : `${className} block dark:hidden select-none`
        }
      />
      {!forceLight && (
        <img
          src="/article-flow-writing-dark.svg"
          alt="Article Flow"
          className={`${className} hidden dark:block select-none`}
        />
      )}
    </>
  );
}
