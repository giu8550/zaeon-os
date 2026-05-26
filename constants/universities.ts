// constants/universities.ts
export interface BrazilianUniversity {
  id: string;
  name: string;
  acronym: string;
  state: string;
  city: string;
  website: string;
  logoPath: string;
  color: string;
  isPartner: boolean;
}

export const BRAZILIAN_FEDERAL_UNIVERSITIES: BrazilianUniversity[] = [
  // CEARÁ
  { id: 'ufc', name: 'Universidade Federal do Ceará', acronym: 'UFC', state: 'CE', city: 'Fortaleza', website: 'https://www.ufc.br', logoPath: '/assets/universities/ufc.png', color: '#003DA5', isPartner: true },
  { id: 'unilab', name: 'Universidade da Integração Internacional da Lusofonia Afro-Brasileira', acronym: 'UNILAB', state: 'CE', city: 'Redenção', website: 'https://www.unilab.edu.br', logoPath: '/assets/universities/unilab.png', color: '#006633', isPartner: true },
  { id: 'ifce', name: 'Instituto Federal de Educação, Ciência e Tecnologia do Ceará', acronym: 'IFCE', state: 'CE', city: 'Fortaleza', website: 'https://ifce.edu.br', logoPath: '/assets/universities/ifce.png', color: '#1B5E20', isPartner: true },
  { id: 'uva', name: 'Universidade Estadual Vale do Acaraú', acronym: 'UVA', state: 'CE', city: 'Sobral', website: 'https://www.uvanet.br', logoPath: '/assets/universities/uva.png', color: '#4A148C', isPartner: false },
  // NORDESTE
  { id: 'ufal', name: 'Universidade Federal de Alagoas', acronym: 'UFAL', state: 'AL', city: 'Maceió', website: 'https://ufal.edu.br', logoPath: '/assets/universities/ufal.png', color: '#B71C1C', isPartner: false },
  { id: 'ufba', name: 'Universidade Federal da Bahia', acronym: 'UFBA', state: 'BA', city: 'Salvador', website: 'https://www.ufba.br', logoPath: '/assets/universities/ufba.png', color: '#1A237E', isPartner: false },
  { id: 'ufrb', name: 'Universidade Federal do Recôncavo da Bahia', acronym: 'UFRB', state: 'BA', city: 'Cruz das Almas', website: 'https://www.ufrb.edu.br', logoPath: '/assets/universities/ufrb.png', color: '#004D40', isPartner: false },
  { id: 'ufsb', name: 'Universidade Federal do Sul da Bahia', acronym: 'UFSB', state: 'BA', city: 'Itabuna', website: 'https://ufsb.edu.br', logoPath: '/assets/universities/ufsb.png', color: '#006064', isPartner: false },
  { id: 'ufma', name: 'Universidade Federal do Maranhão', acronym: 'UFMA', state: 'MA', city: 'São Luís', website: 'https://portais.ufma.br', logoPath: '/assets/universities/ufma.png', color: '#1B5E20', isPartner: false },
  { id: 'ufpb', name: 'Universidade Federal da Paraíba', acronym: 'UFPB', state: 'PB', city: 'João Pessoa', website: 'https://www.ufpb.br', logoPath: '/assets/universities/ufpb.png', color: '#880E4F', isPartner: false },
  { id: 'ufcg', name: 'Universidade Federal de Campina Grande', acronym: 'UFCG', state: 'PB', city: 'Campina Grande', website: 'https://www.ufcg.edu.br', logoPath: '/assets/universities/ufcg.png', color: '#4A148C', isPartner: false },
  { id: 'ufpe', name: 'Universidade Federal de Pernambuco', acronym: 'UFPE', state: 'PE', city: 'Recife', website: 'https://www.ufpe.br', logoPath: '/assets/universities/ufpe.png', color: '#E65100', isPartner: false },
  { id: 'ufrpe', name: 'Universidade Federal Rural de Pernambuco', acronym: 'UFRPE', state: 'PE', city: 'Recife', website: 'https://www.ufrpe.br', logoPath: '/assets/universities/ufrpe.png', color: '#33691E', isPartner: false },
  { id: 'univasf', name: 'Universidade Federal do Vale do São Francisco', acronym: 'UNIVASF', state: 'PE', city: 'Petrolina', website: 'https://www.univasf.edu.br', logoPath: '/assets/universities/univasf.png', color: '#BF360C', isPartner: false },
  { id: 'ufersa', name: 'Universidade Federal Rural do Semi-Árido', acronym: 'UFERSA', state: 'RN', city: 'Mossoró', website: 'https://ufersa.edu.br', logoPath: '/assets/universities/ufersa.png', color: '#558B2F', isPartner: false },
  { id: 'ufrn', name: 'Universidade Federal do Rio Grande do Norte', acronym: 'UFRN', state: 'RN', city: 'Natal', website: 'https://www.ufrn.br', logoPath: '/assets/universities/ufrn.png', color: '#1A237E', isPartner: false },
  { id: 'ufpi', name: 'Universidade Federal do Piauí', acronym: 'UFPI', state: 'PI', city: 'Teresina', website: 'https://www.ufpi.br', logoPath: '/assets/universities/ufpi.png', color: '#4E342E', isPartner: false },
  { id: 'ufs', name: 'Universidade Federal de Sergipe', acronym: 'UFS', state: 'SE', city: 'São Cristóvão', website: 'https://www.ufs.br', logoPath: '/assets/universities/ufs.png', color: '#006064', isPartner: false },
  // NORTE
  { id: 'ufpa', name: 'Universidade Federal do Pará', acronym: 'UFPA', state: 'PA', city: 'Belém', website: 'https://www.ufpa.br', logoPath: '/assets/universities/ufpa.png', color: '#1B5E20', isPartner: false },
  { id: 'ufra', name: 'Universidade Federal Rural da Amazônia', acronym: 'UFRA', state: 'PA', city: 'Belém', website: 'https://www.ufra.edu.br', logoPath: '/assets/universities/ufra.png', color: '#1B5E20', isPartner: false },
  { id: 'unifap', name: 'Universidade Federal do Amapá', acronym: 'UNIFAP', state: 'AP', city: 'Macapá', website: 'https://www2.unifap.br', logoPath: '/assets/universities/unifap.png', color: '#006064', isPartner: false },
  { id: 'ufam', name: 'Universidade Federal do Amazonas', acronym: 'UFAM', state: 'AM', city: 'Manaus', website: 'https://www.ufam.edu.br', logoPath: '/assets/universities/ufam.png', color: '#1A237E', isPartner: false },
  { id: 'ufrr', name: 'Universidade Federal de Roraima', acronym: 'UFRR', state: 'RR', city: 'Boa Vista', website: 'https://ufrr.br', logoPath: '/assets/universities/ufrr.png', color: '#4A148C', isPartner: false },
  { id: 'unir', name: 'Fundação Universidade Federal de Rondônia', acronym: 'UNIR', state: 'RO', city: 'Porto Velho', website: 'https://www.unir.br', logoPath: '/assets/universities/unir.png', color: '#BF360C', isPartner: false },
  { id: 'ufac', name: 'Universidade Federal do Acre', acronym: 'UFAC', state: 'AC', city: 'Rio Branco', website: 'https://www.ufac.br', logoPath: '/assets/universities/ufac.png', color: '#B71C1C', isPartner: false },
  { id: 'ufopa', name: 'Universidade Federal do Oeste do Pará', acronym: 'UFOPA', state: 'PA', city: 'Santarém', website: 'https://www.ufopa.edu.br', logoPath: '/assets/universities/ufopa.png', color: '#004D40', isPartner: false },
  { id: 'unifesspa', name: 'Universidade Federal do Sul e Sudeste do Pará', acronym: 'UNIFESSPA', state: 'PA', city: 'Marabá', website: 'https://www.unifesspa.edu.br', logoPath: '/assets/universities/unifesspa.png', color: '#37474F', isPartner: false },
  // CENTRO-OESTE
  { id: 'unb', name: 'Universidade de Brasília', acronym: 'UnB', state: 'DF', city: 'Brasília', website: 'https://www.unb.br', logoPath: '/assets/universities/unb.png', color: '#1B5E20', isPartner: false },
  { id: 'ufg', name: 'Universidade Federal de Goiás', acronym: 'UFG', state: 'GO', city: 'Goiânia', website: 'https://www.ufg.br', logoPath: '/assets/universities/ufg.png', color: '#E65100', isPartner: false },
  { id: 'ufgd', name: 'Universidade Federal da Grande Dourados', acronym: 'UFGD', state: 'MS', city: 'Dourados', website: 'https://www.ufgd.edu.br', logoPath: '/assets/universities/ufgd.png', color: '#880E4F', isPartner: false },
  { id: 'ufms', name: 'Universidade Federal de Mato Grosso do Sul', acronym: 'UFMS', state: 'MS', city: 'Campo Grande', website: 'https://www.ufms.br', logoPath: '/assets/universities/ufms.png', color: '#4A148C', isPartner: false },
  { id: 'ufmt', name: 'Universidade Federal de Mato Grosso', acronym: 'UFMT', state: 'MT', city: 'Cuiabá', website: 'https://www.ufmt.br', logoPath: '/assets/universities/ufmt.png', color: '#B71C1C', isPartner: false },
  // SUDESTE
  { id: 'ufes', name: 'Universidade Federal do Espírito Santo', acronym: 'UFES', state: 'ES', city: 'Vitória', website: 'https://www.ufes.br', logoPath: '/assets/universities/ufes.png', color: '#004D40', isPartner: false },
  { id: 'ufjf', name: 'Universidade Federal de Juiz de Fora', acronym: 'UFJF', state: 'MG', city: 'Juiz de Fora', website: 'https://www.ufjf.br', logoPath: '/assets/universities/ufjf.png', color: '#1A237E', isPartner: false },
  { id: 'ufla', name: 'Universidade Federal de Lavras', acronym: 'UFLA', state: 'MG', city: 'Lavras', website: 'https://www.ufla.br', logoPath: '/assets/universities/ufla.png', color: '#1B5E20', isPartner: false },
  { id: 'ufmg', name: 'Universidade Federal de Minas Gerais', acronym: 'UFMG', state: 'MG', city: 'Belo Horizonte', website: 'https://www.ufmg.br', logoPath: '/assets/universities/ufmg.png', color: '#1A237E', isPartner: false },
  { id: 'ufop', name: 'Universidade Federal de Ouro Preto', acronym: 'UFOP', state: 'MG', city: 'Ouro Preto', website: 'https://www.ufop.br', logoPath: '/assets/universities/ufop.png', color: '#BF360C', isPartner: false },
  { id: 'uftm', name: 'Universidade Federal do Triângulo Mineiro', acronym: 'UFTM', state: 'MG', city: 'Uberaba', website: 'https://www.uftm.edu.br', logoPath: '/assets/universities/uftm.png', color: '#006064', isPartner: false },
  { id: 'ufv', name: 'Universidade Federal de Viçosa', acronym: 'UFV', state: 'MG', city: 'Viçosa', website: 'https://www.ufv.br', logoPath: '/assets/universities/ufv.png', color: '#558B2F', isPartner: false },
  { id: 'unifal', name: 'Universidade Federal de Alfenas', acronym: 'UNIFAL', state: 'MG', city: 'Alfenas', website: 'https://www.unifal-mg.edu.br', logoPath: '/assets/universities/unifal.png', color: '#4A148C', isPartner: false },
  { id: 'unifei', name: 'Universidade Federal de Itajubá', acronym: 'UNIFEI', state: 'MG', city: 'Itajubá', website: 'https://unifei.edu.br', logoPath: '/assets/universities/unifei.png', color: '#E65100', isPartner: false },
  { id: 'ufabc', name: 'Universidade Federal do ABC', acronym: 'UFABC', state: 'SP', city: 'Santo André', website: 'https://www.ufabc.edu.br', logoPath: '/assets/universities/ufabc.png', color: '#1A237E', isPartner: false },
  { id: 'ufscar', name: 'Universidade Federal de São Carlos', acronym: 'UFSCar', state: 'SP', city: 'São Carlos', website: 'https://www.ufscar.br', logoPath: '/assets/universities/ufscar.png', color: '#880E4F', isPartner: false },
  { id: 'unifesp', name: 'Universidade Federal de São Paulo', acronym: 'UNIFESP', state: 'SP', city: 'São Paulo', website: 'https://www.unifesp.br', logoPath: '/assets/universities/unifesp.png', color: '#1B5E20', isPartner: false },
  { id: 'uff', name: 'Universidade Federal Fluminense', acronym: 'UFF', state: 'RJ', city: 'Niterói', website: 'https://www.uff.br', logoPath: '/assets/universities/uff.png', color: '#006064', isPartner: false },
  { id: 'ufrj', name: 'Universidade Federal do Rio de Janeiro', acronym: 'UFRJ', state: 'RJ', city: 'Rio de Janeiro', website: 'https://ufrj.br', logoPath: '/assets/universities/ufrj.png', color: '#1A237E', isPartner: false },
  { id: 'ufrrj', name: 'Universidade Federal Rural do Rio de Janeiro', acronym: 'UFRRJ', state: 'RJ', city: 'Seropédica', website: 'https://portal.ufrrj.br', logoPath: '/assets/universities/ufrrj.png', color: '#1B5E20', isPartner: false },
  { id: 'unirio', name: 'Universidade Federal do Estado do Rio de Janeiro', acronym: 'UNIRIO', state: 'RJ', city: 'Rio de Janeiro', website: 'https://www.unirio.br', logoPath: '/assets/universities/unirio.png', color: '#880E4F', isPartner: false },
  // SUL
  { id: 'ufcspa', name: 'Universidade Federal de Ciências da Saúde de Porto Alegre', acronym: 'UFCSPA', state: 'RS', city: 'Porto Alegre', website: 'https://www.ufcspa.edu.br', logoPath: '/assets/universities/ufcspa.png', color: '#004D40', isPartner: false },
  { id: 'ufrgs', name: 'Universidade Federal do Rio Grande do Sul', acronym: 'UFRGS', state: 'RS', city: 'Porto Alegre', website: 'https://www.ufrgs.br', logoPath: '/assets/universities/ufrgs.png', color: '#1A237E', isPartner: false },
  { id: 'ufpel', name: 'Universidade Federal de Pelotas', acronym: 'UFPel', state: 'RS', city: 'Pelotas', website: 'https://portal.ufpel.edu.br', logoPath: '/assets/universities/ufpel.png', color: '#4E342E', isPartner: false },
  { id: 'ufsm', name: 'Universidade Federal de Santa Maria', acronym: 'UFSM', state: 'RS', city: 'Santa Maria', website: 'https://www.ufsm.br', logoPath: '/assets/universities/ufsm.png', color: '#B71C1C', isPartner: false },
  { id: 'furg', name: 'Universidade Federal do Rio Grande', acronym: 'FURG', state: 'RS', city: 'Rio Grande', website: 'https://www.furg.br', logoPath: '/assets/universities/furg.png', color: '#006064', isPartner: false },
  { id: 'unipampa', name: 'Universidade Federal do Pampa', acronym: 'UNIPAMPA', state: 'RS', city: 'Bagé', website: 'https://www.unipampa.edu.br', logoPath: '/assets/universities/unipampa.png', color: '#558B2F', isPartner: false },
  { id: 'uffs', name: 'Universidade Federal da Fronteira Sul', acronym: 'UFFS', state: 'SC', city: 'Chapecó', website: 'https://www.uffs.edu.br', logoPath: '/assets/universities/uffs.png', color: '#1B5E20', isPartner: false },
  { id: 'ufsc', name: 'Universidade Federal de Santa Catarina', acronym: 'UFSC', state: 'SC', city: 'Florianópolis', website: 'https://ufsc.br', logoPath: '/assets/universities/ufsc.png', color: '#1A237E', isPartner: false },
  { id: 'ufpr', name: 'Universidade Federal do Paraná', acronym: 'UFPR', state: 'PR', city: 'Curitiba', website: 'https://www.ufpr.br', logoPath: '/assets/universities/ufpr.png', color: '#B71C1C', isPartner: false },
  { id: 'utfpr', name: 'Universidade Tecnológica Federal do Paraná', acronym: 'UTFPR', state: 'PR', city: 'Curitiba', website: 'https://www.utfpr.edu.br', logoPath: '/assets/universities/utfpr.png', color: '#4A148C', isPartner: false },
  { id: 'unioeste', name: 'Universidade Estadual do Oeste do Paraná', acronym: 'UNIOESTE', state: 'PR', city: 'Cascavel', website: 'https://www.unioeste.br', logoPath: '/assets/universities/unioeste.png', color: '#006064', isPartner: false },
  // TOCANTINS
  { id: 'uft', name: 'Universidade Federal do Tocantins', acronym: 'UFT', state: 'TO', city: 'Palmas', website: 'https://www.uft.edu.br', logoPath: '/assets/universities/uft.png', color: '#E65100', isPartner: false },
  { id: 'ifto', name: 'Instituto Federal do Tocantins', acronym: 'IFTO', state: 'TO', city: 'Palmas', website: 'https://www.ifto.edu.br', logoPath: '/assets/universities/ifto.png', color: '#1B5E20', isPartner: false },
];
