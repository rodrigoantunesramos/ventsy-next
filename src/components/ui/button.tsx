export function Button({ children, variant = "primary", ...props }: any) {
  const styles: any = {
    primary: "bg-pink-500 text-white hover:bg-pink-600",
    secondary: "bg-gray-100 hover:bg-gray-200",
  };

  return (
    <button
      {...props}
      className={`bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600 transition ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
