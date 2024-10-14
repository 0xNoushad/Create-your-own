
"use client"
import { Button } from "../ui/button"
import { Loader2, Wallet as WalletIcon } from "lucide-react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useLayoutEffect, useState } from "react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

const CustomWalletConnect: React.FC = () => {
  const { setVisible } = useWalletModal()
  const { connecting, connected, disconnect, disconnecting } = useWallet()
  const [label, setLabel] = useState("Connect Wallet")

  useLayoutEffect(() => {
    if (connecting) setLabel("Connecting...")
  }, [connecting])

  useLayoutEffect(() => {
    if (disconnecting) setLabel("Disconnecting..")
  }, [disconnecting])

  useLayoutEffect(() => {
    if (connected) setLabel("Connected")
    else setLabel('Connect Wallet')
  }, [connected])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2 px-8 bg-[#375DFB] hover:bg-[#375DF3] tracking-wider" disabled={label === 'Connecting...'} onClick={() => setVisible(true)}>
          {label === 'Connecting...' ? <Loader2 className="animate-spin" /> : <WalletIcon />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      {connected && (
        <DropdownMenuContent className="flex flex-col py-2">
          <DropdownMenuItem asChild>
            <Button variant="ghost" className="text-base text-destructive justify-start pl-4 pr-12 tracking-wider" onClick={() => disconnect()}>
              Disconnect
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}

export default CustomWalletConnect
  