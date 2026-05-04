export const pixFormatValidation = (pixKey: string): boolean => {
  const cpf = /(^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$)/g;
  const cnpj = /(^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$)/g;
  const telefone = /(^[0-9]{2})?(\s|-)?(9?[0-9]{4})-?([0-9]{4}$)/g;

  if (pixKey.match(cpf) || pixKey.match(cnpj) || pixKey.match(telefone)) {
    return true;
  }

  return false;
};

export const postProcessKey = (pixKey: string): string => {
  pixKey = pixKey.replace(/[-.()/]/g, '');
  return pixKey;
};
