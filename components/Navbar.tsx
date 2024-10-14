import dynamic from 'next/dynamic';

const Navbar = () => {
    const WalletsProvider = dynamic(
        () => import("./wallets/CustomWalletConnect"),
        {
            ssr: false,
        }
    );
    return (
        <nav className=" p-4">
          <div className="container mx-auto flex justify-between items-center">
              <a  href='/' className="flex items-center">
                <span className="ml-2 text-lg font-medium">Dust Cleaner</span>
              </a>

            <WalletsProvider />
          </div>
        </nav>
      );
}

export default Navbar