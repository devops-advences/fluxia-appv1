'use client'

import { createContext, useContext } from 'react'

export type CustomerEntity = {
  id: string
  name: string
  country_code: string
  legal_entity: boolean
  firm_id: string
  admin: boolean
}

type CustomerContextType = {
  activeCustomer: CustomerEntity | null
  customers: CustomerEntity[]
  setActiveCustomerId: (id: string) => void
}

export const CustomerContext = createContext<CustomerContextType>({
  activeCustomer: null,
  customers: [],
  setActiveCustomerId: () => {},
})

export const useCustomer = () => useContext(CustomerContext)
